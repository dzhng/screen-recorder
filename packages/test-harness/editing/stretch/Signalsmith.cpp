#include "vendor/signalsmith-stretch.h"
#include <chrono>
#include <fstream>
#include <iostream>
#include <stdexcept>

// Fixed-size research seam: mono Float32/48kHz, explicitly selected samples only.
int main(int argc, char **argv) try {
    if (argc != 7 && argc != 8) throw std::runtime_error("input output start end outputFrames exact|tail [blockSamples]");
    int first = std::stoi(argv[3]), end = std::stoi(argv[4]), wanted = std::stoi(argv[5]);
    std::string mode = argv[6];
    if (first < 0 || end <= first || end - first > 48000*60 || wanted < 1 || wanted > 48000*60
        || (mode != "exact" && mode != "tail")) throw std::runtime_error("Invalid bounded request");
    std::ifstream source(argv[1], std::ios::binary | std::ios::ate);
    if (!source || source.tellg() < std::streamoff(end)*4) throw std::runtime_error("Missing selected input");
    std::vector<float> input(end - first);
    source.seekg(std::streamoff(first)*4);
    source.read(reinterpret_cast<char *>(input.data()), input.size()*4);
    if (!source) throw std::runtime_error("Short selected input");
    signalsmith::stretch::SignalsmithStretch<float> stretch(0);
    int block = argc == 8 ? std::stoi(argv[7]) : 0;
    if (block && (block < 64 || block > 5760 || block % 4)) throw std::runtime_error("Invalid research block");
    if (block) stretch.configure(1, block, block/4);
    else stretch.presetDefault(1, 48000);
    stretch.setTransposeFactor(1);
    int latencyIn = stretch.inputLatency(), latencyOut = stretch.outputLatency();
    int count = int(input.size());
    double speed = double(count)/wanted;
    std::vector<float> output(wanted + (mode == "tail" ? latencyOut + latencyIn : 0));
    float *inputs[] = {input.data()}, *outputs[] = {output.data()};
    auto began = std::chrono::steady_clock::now();
    bool identity = mode == "exact" && count == wanted;
    if (identity) {
        output = input;
    } else if (mode == "exact") {
        if (!stretch.exact(inputs, count, outputs, wanted)) throw std::runtime_error("Selected input too short for exact recipe");
    } else {
        input.resize(count + latencyIn);
        inputs[0] = input.data();
        stretch.seek(inputs, latencyIn, speed);
        inputs[0] += latencyIn;
        stretch.process(inputs, count, outputs, wanted);
        outputs[0] += wanted;
        stretch.flush(outputs, latencyIn + latencyOut);
    }
    double seconds = std::chrono::duration<double>(std::chrono::steady_clock::now() - began).count();
    // The caller chooses a fresh directory; refuse accidental evidence replacement.
    if (std::ifstream(argv[2]).good()) throw std::runtime_error("Output already exists");
    std::ofstream destination(argv[2], std::ios::binary);
    destination.write(reinterpret_cast<const char *>(output.data()), output.size()*4);
    if (!destination) throw std::runtime_error("Output write failed");
    std::cout << "{\"inputLatency\":" << latencyIn << ",\"outputLatency\":" << latencyOut
        << ",\"blockSamples\":" << stretch.blockSamples() << ",\"intervalSamples\":" << stretch.intervalSamples()
        << ",\"frames\":" << output.size() << ",\"renderSeconds\":" << seconds
        << ",\"identityBypass\":" << (identity ? "true" : "false")
        << ",\"speed\":" << speed << ",\"mode\":\"" << mode << "\"}\n";
    return 0;
} catch (const std::exception &error) { std::cerr << error.what() << '\n'; return 1; }
