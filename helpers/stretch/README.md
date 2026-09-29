# Frozen stretch parity adapter

This isolated package preserves the selected mono48k Float32 Signalsmith recipe.
It is not an app dependency or advertised retime capability. One vendored header
owner serves both this package and the unchanged research C++ reference; the
manifest pins source and license identities. Historical evidence keeps original
paths, while research runners point to this relocated owner.

Equal selected/output counts copy exact bits. Otherwise the pinned default
preset, seed0, pitch factor1 and portable FFT call upstream exact processing,
including its output seek and reflected-tail endpoint shaping. Unsupported counts
return an error; upstream's zeroed failure buffer never becomes a successful result.
No wrapper crop, crossfade, surrounding real context or automatic short preset is
introduced. Numerical parity does not establish speech quality.

The typed adapter is bounded to the original60s mono48k research domain. This is
an isolated checkpoint limit, not product policy. It uses complete input/output
buffers and checks cancellation before and after upstream's synchronous call;
it cannot cancel inside that call. A production state-domain/scale design remains
part of retiming integration. Public preparation stays with existing core owners.

Build and compare with hash-verified retained reference directories:

```sh
swift build --package-path helpers/stretch -c release --product StretchParity
node packages/test-harness/editing/stretch-native-parity.mjs \
  /tmp/screenrec-stretch-frozen /tmp/screenrec-signalsmith-identity /tmp/stretch-parity-fresh
```

The harness pins retained source/output hashes before comparing complete PCM,
checks unsupported/error publication and records command failures. It does not
rerun quality research. The parity executable is an offline test seam, not a
second worker protocol. The research source remains byte-identical; runner include
paths use this C target's parent so its original vendor include still resolves.

Later public adoption must bind accepted recipe identity through the existing
execution manifest and reuse PreparedAudioStore, JobQueue and AssetStore. Mono
parity does not establish stereo policy, long-running cancellation, protected-word
joins or listening acceptance. No recorded response to an audition is not proof
that the audio was unheard.
