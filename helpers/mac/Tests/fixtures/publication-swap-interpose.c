#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// Control the actual kernel boundary; production receives no test switch.
static int controlled_swap(int fromfd, const char *from, int tofd, const char *to, unsigned int flags) {
    const char *mode = getenv("YAP_SWAP_FAULT");
    if (mode && (flags & RENAME_SWAP) && !strcmp(from, "swap")) {
        if (!strcmp(mode, "before")) _exit(86);
        if (!strcmp(mode, "foreign") || !strcmp(mode, "modified")) {
            if (!strcmp(mode, "foreign") && unlinkat(tofd, to, 0)) _exit(87);
            int fd = openat(tofd, to, O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW, 0600);
            const char *bytes = !strcmp(mode, "modified") ? "foreign raced bytes!" : "foreign raced bytes";
            size_t length = strlen(bytes);
            if (fd < 0 || write(fd, bytes, length) != length || close(fd)) _exit(87);
        }
        if (!strcmp(mode, "symlink")) {
            const char *target = getenv("YAP_SWAP_TARGET");
            if (unlinkat(tofd, to, 0) || symlinkat(target ? target : "../sentinel", tofd, to)) _exit(87);
        }
    }
    int result = renameatx_np(fromfd, from, tofd, to, flags);
    if (mode && (flags & RENAME_SWAP) && result == 0) {
        if (!strcmp(mode, "after")) _exit(86);
        if (!strcmp(mode, "successor")) {
            if (unlinkat(tofd, to, 0)) _exit(87);
            int fd = openat(tofd, to, O_WRONLY | O_CREAT | O_EXCL, 0600);
            if (fd < 0 || write(fd, "foreign successor", 17) != 17 || close(fd)) _exit(87);
        }
    }
    return result;
}
__attribute__((used)) static struct { const void *replacement; const void *original; }
interpose_swap __attribute__((section("__DATA,__interpose"))) = {
    (const void *)&controlled_swap, (const void *)&renameatx_np
};
