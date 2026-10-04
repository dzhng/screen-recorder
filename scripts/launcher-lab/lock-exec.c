#include <sys/file.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// Research boundary, not a production launcher. Its descriptor deliberately
// survives exec so the actual Node lifetime owns the kernel-backed exclusion.
int main(int argc, char **argv) {
    if (argc < 4 || (strcmp(argv[1], "shared") && strcmp(argv[1], "exclusive"))) {
        fprintf(stderr, "Usage: lock-exec shared|exclusive LOCK COMMAND [ARG...]\n");
        return 64;
    }
    int fd = open(argv[2], O_CREAT | O_RDWR | O_NOFOLLOW, 0600);
    if (fd < 0) { perror("open lock"); return 74; }
    int mode = !strcmp(argv[1], "shared") ? LOCK_SH : LOCK_EX;
    if (flock(fd, mode | LOCK_NB) != 0) {
        fprintf(stderr, "UPDATING: another lifetime owns the installation\n");
        return 75;
    }
    char descriptor[32];
    snprintf(descriptor, sizeof(descriptor), "%d", fd);
    setenv("SCREENREC_LAB_LOCK_FD", descriptor, 1);
    execvp(argv[3], argv + 3);
    perror("exec");
    return 74;
}
