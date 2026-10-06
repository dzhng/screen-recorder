#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

__attribute__((constructor)) static void hold_native_start(void) {
    const char *marker = getenv("YAP_TEST_NATIVE_HELD");
    if (!marker) return;
    int output = open(marker, O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (output < 0) return;
    dprintf(output, "%d", getpid());
    close(output);
    raise(SIGSTOP);
}
