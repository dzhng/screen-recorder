#include <fcntl.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <unistd.h>
#include <sys/stat.h>

// Replace an ancestor after the real directory has been opened. This exercises production
// syscalls at the race boundary without adding a test hook to the managed-files implementation.
static int swapped;
static int swap_openat(int parent, const char *name, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = (mode_t)va_arg(args, int);
        va_end(args);
    }
    int result = openat(parent, name, flags, mode);
    const char *match = getenv("SCREENREC_SWAP_NAME");
    if (result >= 0 && !swapped && match && strcmp(name, match) == 0) {
        swapped = 1;
        if (rename(getenv("SCREENREC_SWAP_FROM"), getenv("SCREENREC_SWAP_SAVE")) != 0) _exit(90);
        if (symlink(getenv("SCREENREC_SWAP_EXTERNAL"), getenv("SCREENREC_SWAP_FROM")) != 0) _exit(91);
        const char marker[] = "managed-swap-complete\n";
        if (write(STDERR_FILENO, marker, sizeof(marker) - 1) < 0) _exit(92);
    }
    return result;
}

__attribute__((used)) static struct {
    const void *replacement;
    const void *original;
} interpose_openat __attribute__((section("__DATA,__interpose"))) = {
    (const void *)&swap_openat, (const void *)&openat
};

static int exact_inode_fstat(int fd, struct stat *info) {
    int result = fstat(fd, info);
    const char *actual = getenv("SCREENREC_ACTUAL_HOME_INO");
    const char *reported = getenv("SCREENREC_REPORTED_HOME_INO");
    if (result == 0 && actual && reported && info->st_ino == strtoull(actual, NULL, 10)) {
        info->st_ino = strtoull(reported, NULL, 10);
    }
    return result;
}
__attribute__((used)) static struct {
    const void *replacement;
    const void *original;
} interpose_fstat __attribute__((section("__DATA,__interpose"))) = {
    (const void *)&exact_inode_fstat, (const void *)&fstat
};
