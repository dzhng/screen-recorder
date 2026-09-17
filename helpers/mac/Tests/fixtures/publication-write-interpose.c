#include <fcntl.h>
#include <limits.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>

// Abruptly end the actual worker after a partial receipt write, without production test hooks.
static ssize_t interrupted_receipt_write(int fd, const void *bytes, size_t count) {
    char path[PATH_MAX];
    const char *mode = getenv("SCREENREC_RECEIPT_FAULT");
    if ((!mode || strcmp(mode, "after-link")) && count && fcntl(fd, F_GETPATH, path) == 0) {
        const char *leaf = strrchr(path, '/');
        if (leaf && (!strcmp(leaf + 1, "prepared.json") || !strcmp(leaf + 1, "receipt.pending"))) {
            if (write(fd, bytes, 1) != 1) _exit(87);
            _exit(86);
        }
    }
    return write(fd, bytes, count);
}
__attribute__((used)) static struct {
    const void *replacement;
    const void *original;
} interpose_write __attribute__((section("__DATA,__interpose"))) = {
    (const void *)&interrupted_receipt_write, (const void *)&write
};

static int interrupted_pending_unlink(int parent, const char *name, int flags) {
    const char *mode = getenv("SCREENREC_RECEIPT_FAULT");
    if (mode && !strcmp(mode, "after-link") && !strcmp(name, "receipt.pending")) _exit(86);
    return unlinkat(parent, name, flags);
}
__attribute__((used)) static struct {
    const void *replacement;
    const void *original;
} interpose_unlink __attribute__((section("__DATA,__interpose"))) = {
    (const void *)&interrupted_pending_unlink, (const void *)&unlinkat
};
