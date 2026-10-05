#include <sys/file.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <limits.h>

static int fail(const char *code, const char *message, int retryable, int status) {
    printf("{\"id\":\"launcher\",\"ok\":false,\"error\":{\"code\":\"%s\",\"message\":\"%s\",\"retryable\":%s}}\n", code, message, retryable ? "true" : "false");
    return status;
}
static int directory(const char *path) {
    if (mkdir(path, 0700) != 0 && errno != EEXIST) return -1;
    struct stat info;
    if (lstat(path, &info) != 0 || !S_ISDIR(info.st_mode) || info.st_uid != getuid()) return -1;
    return 0;
}
int main(int argc, char **argv) {
    const char *home = getenv("HOME");
    if (!home || !*home) {
        struct passwd *account = getpwuid(getuid());
        if (!account) return fail("SERVICE_UNAVAILABLE", "Cannot resolve account home", 0, 74);
        home = account->pw_dir;
    }
    char path[PATH_MAX], app[PATH_MAX], node[PATH_MAX], cli[PATH_MAX];
    const char *parts[] = {"Library", "Library/Caches", "Library/Caches/com.david.screenrec"};
    for (size_t i = 0; i < sizeof(parts) / sizeof(parts[0]); ++i) {
        if (snprintf(path, sizeof(path), "%s/%s", home, parts[i]) >= (int)sizeof(path) || directory(path) != 0)
            return fail("SERVICE_UNAVAILABLE", "Cannot prepare installation lock directory", 0, 74);
    }
    if (snprintf(path, sizeof(path), "%s/Library/Caches/com.david.screenrec/launch.lock", home) >= (int)sizeof(path))
        return fail("SERVICE_UNAVAILABLE", "Account home path is too long", 0, 74);
    // Deliberately inherited by Node: exclusion owns the complete CLI/MCP process lifetime.
    int fd = open(path, O_CREAT | O_RDWR | O_NOFOLLOW, 0600);
    struct stat info;
    if (fd < 0 || fstat(fd, &info) != 0 || !S_ISREG(info.st_mode) || info.st_uid != getuid() || (info.st_mode & 077) != 0)
        return fail("SERVICE_UNAVAILABLE", "Cannot open private installation lock", 0, 74);
    if (flock(fd, LOCK_SH | LOCK_NB) != 0) {
        if (errno == EWOULDBLOCK) return fail("UPDATING", "Installation is being replaced; retry after the update", 1, 75);
        return fail("SERVICE_UNAVAILABLE", "Cannot acquire installation lock", 0, 74);
    }
    // No access to the replaceable bundle occurs before shared exclusion is held.
    const char *override = getenv("SCREENREC_APP");
    if (override && *override) {
        if (snprintf(app, sizeof(app), "%s", override) >= (int)sizeof(app))
            return fail("SERVICE_UNAVAILABLE", "App path is too long", 0, 74);
    } else if (snprintf(app, sizeof(app), "%s/Applications/Screen Recorder.app", home) >= (int)sizeof(app))
        return fail("SERVICE_UNAVAILABLE", "App path is too long", 0, 74);
    if (snprintf(node, sizeof(node), "%s/Contents/Resources/node/bin/node", app) >= (int)sizeof(node) ||
        snprintf(cli, sizeof(cli), "%s/Contents/Resources/cli/main.mjs", app) >= (int)sizeof(cli))
        return fail("SERVICE_UNAVAILABLE", "App path is too long", 0, 74);
    setenv("SCREENREC_APP", app, 1);
    char **arguments = calloc((size_t)argc + 2, sizeof(char *));
    if (!arguments) return fail("SERVICE_UNAVAILABLE", "Cannot allocate launcher arguments", 0, 74);
    arguments[0] = node; arguments[1] = cli;
    for (int i = 1; i < argc; ++i) arguments[i + 1] = argv[i];
    execv(node, arguments);
    return fail("SERVICE_UNAVAILABLE", "Bundled Node could not start; verify the installed app", 0, 74);
}
