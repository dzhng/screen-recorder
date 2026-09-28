#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "rnnoise.h"
int main(int argc, char **argv) {
    if (argc != 4) return 2;
    char *end;
    long tail = strtol(argv[3], &end, 10);
    if (*end || tail < 0 || tail > 4) return 2;
    FILE *in = fopen(argv[1], "rb"), *out = fopen(argv[2], "wb");
    if (!in || !out) return 3;
    int frame = rnnoise_get_frame_size();
    float *x = calloc(frame, sizeof(float)), *y = calloc(frame, sizeof(float));
    DenoiseState *state = rnnoise_create(NULL);
    if (!x || !y || !state) return 4;
    for (;;) {
        size_t count = fread(x, sizeof(float), frame, in);
        if (ferror(in)) return 5;
        if (!count) break;
        for (size_t i = 0; i < count; ++i) x[i] *= 32768.f;
        memset(x + count, 0, (frame - count) * sizeof(float));
        rnnoise_process_frame(state, y, x);
        for (int i = 0; i < frame; ++i) y[i] /= 32768.f;
        if (fwrite(y, sizeof(float), frame, out) != (size_t)frame) return 6;
    }
    memset(x, 0, frame * sizeof(float));
    for (long n = 0; n < tail; ++n) {
        rnnoise_process_frame(state, y, x);
        for (int i = 0; i < frame; ++i) y[i] /= 32768.f;
        if (fwrite(y, sizeof(float), frame, out) != (size_t)frame) return 6;
    }
    rnnoise_destroy(state);
    free(x); free(y);
    if (fclose(in) || fclose(out)) return 7;
    return 0;
}
