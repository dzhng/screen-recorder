#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static ssize_t held_pread(int fd, void *buffer, size_t bytes, off_t offset) {
    ssize_t read_bytes = pread(fd, buffer, bytes, offset);
    const char *marker = getenv("YAP_TEST_COPY_BARRIER");
    const char *partial = getenv("YAP_TEST_COPY_PARTIAL");
    int at_barrier = partial && partial[0] == '1' ? offset > 0 : offset == 0;
    const char *minimum = getenv("YAP_TEST_COPY_MIN_FD");
    if (fd >= (minimum ? atoi(minimum) : 4) && at_barrier && read_bytes > 0 && marker) {
        int output = open(marker, O_WRONLY | O_CREAT | O_EXCL, 0600);
        if (output >= 0) {
            dprintf(output, "%d", getpid());
            close(output);
            raise(SIGSTOP);
        }
    }
    return read_bytes;
}
__attribute__((used)) static struct { const void *replacement; const void *original; }
interpose_pread __attribute__((section("__DATA,__interpose"))) = {
    (const void *)held_pread, (const void *)pread
};
