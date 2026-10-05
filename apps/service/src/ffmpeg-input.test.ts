import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileCliOwner } from "./cli-owner.fixture.js";
import { inspectFfmpegInput } from "./ffmpeg-input.js";

let directory: string;
let owner: string;
let probe: string;
beforeAll(async () => {
  directory = await mkdtemp("/tmp/screenrec-input-");
  owner = await compileCliOwner(directory);
  probe = join(directory, "probe.cjs");
  await writeFile(
    probe,
    `#!${process.execPath}\nconst {readFileSync}=require('node:fs');const value=readFileSync(3,'utf8');const whitelist=process.argv.indexOf('-format_whitelist');if(value.startsWith('caff')&&whitelist>=0&&!process.argv[whitelist+1].split(',').includes('caf'))process.exit(1);process.stdout.write(JSON.stringify({streams:[{index:0,id:value.startsWith('caff')?undefined:value==='original'?'0x2':'0x9',codec_type:'audio'}],format:{format_name:'mov,mp4,m4a,3gp,3g2,mj2'}}));`,
    { mode: 0o755 },
  );
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
const metadata = {
  originUs: -12000,
  streams: [
    {
      id: "track:2",
      kind: "audio" as const,
      codec: "mp4a",
      decodable: true,
      channels: 2,
      sampleRate: 48000,
      startUs: 40000,
      endUs: 1040000,
      segments: [
        {
          startUs: 40000,
          endUs: 1040000,
          empty: false,
          mediaStartUs: 12000,
          mediaDurationUs: 1000000,
        },
      ],
    },
  ],
};
it("pathname replacement after admission cannot substitute the held operand", async () => {
  const path = join(directory, "source");
  await writeFile(path, "original");
  const file = await open(path, "r");
  await rename(path, join(directory, "old"));
  await writeFile(path, "replacement");
  try {
    const result = await inspectFfmpegInput(
      { executable: probe, ownerExecutable: owner },
      { file, metadata, streamId: "track:2" },
    );
    expect(result.map).toBe("0:0");
    expect(result.stream).toMatchObject({
      startUs: 40000,
      endUs: 1040000,
      segments: [{ mediaStartUs: 12000, startUs: 40000, endUs: 1040000 }],
    });
    expect(result.originUs).toBe(-12000);
  } finally {
    await file.close();
  }
});

it("a different or ambiguous selector cannot substitute the explicit native stream", async () => {
  const path = join(directory, "different-stream");
  await writeFile(path, "replacement");
  const file = await open(path, "r");
  try {
    await expect(
      inspectFfmpegInput(
        { executable: probe, ownerExecutable: owner },
        { file, metadata, streamId: "track:2" },
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
  } finally {
    await file.close();
  }
});

it("surround cannot become supported audio merely because FFmpeg decodes it", async () => {
  const path = join(directory, "surround");
  await writeFile(path, "original");
  const file = await open(path, "r");
  try {
    await expect(
      inspectFfmpegInput(
        { executable: probe, ownerExecutable: owner },
        {
          file,
          metadata: { ...metadata, streams: [{ ...metadata.streams[0]!, channels: 6 }] },
          streamId: "track:2",
        },
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
  } finally {
    await file.close();
  }
});

it("retained input starts at its source origin after an earlier read advanced the lease", async () => {
  const path = join(directory, "previously-read");
  await writeFile(path, "original");
  const file = await open(path, "r");
  try {
    expect(await file.readFile("utf8")).toBe("original");
    const input = await inspectFfmpegInput(
      { executable: probe, ownerExecutable: owner },
      { file, metadata, streamId: "track:2" },
    );
    expect(input.map).toBe("0:0");
  } finally {
    await file.close();
  }
});

it("native-admitted CAF remains eligible for retained FFmpeg inspection", async () => {
  const path = join(directory, "native.caf");
  await writeFile(path, "caff-original");
  const file = await open(path, "r");
  try {
    const input = await inspectFfmpegInput(
      { executable: probe, ownerExecutable: owner },
      {
        file,
        metadata: { ...metadata, streams: [{ ...metadata.streams[0]!, codec: "lpcm" }] },
        streamId: "track:2",
      },
    );
    expect(input.map).toBe("0:0");
  } finally {
    await file.close();
  }
});

it("explicit color inspection binds declarations to the selected held video and preserves unknown range", async () => {
  const colorProbe = join(directory, "color-probe.cjs");
  await writeFile(
    colorProbe,
    `#!${process.execPath}\nconst {readFileSync}=require('node:fs');const rows=JSON.parse(readFileSync(3,'utf8'));const fields=process.argv[process.argv.indexOf('-show_entries')+1];process.stdout.write(JSON.stringify({streams:rows.map(row=>fields.includes('color_range')?row:{index:row.index,id:row.id,codec_type:row.codec_type})}));`,
    { mode: 0o755 },
  );
  const path = join(directory, "colors");
  await writeFile(
    path,
    JSON.stringify([
      {
        index: 0,
        id: "0x1",
        codec_type: "video",
        color_range: "pc",
        color_primaries: "bt709",
        color_transfer: "bt709",
        color_space: "bt709",
        pix_fmt: "yuv420p",
      },
      {
        index: 1,
        id: "0x2",
        codec_type: "video",
        color_primaries: "bt2020",
        color_transfer: "smpte2084",
        color_space: "bt2020nc",
        pix_fmt: "yuv420p10le",
      },
    ]),
  );
  const file = await open(path, "r");
  const videoMetadata = {
    originUs: 0,
    streams: [
      { id: "track:1", kind: "video" as const, codec: "avc1", decodable: true },
      { id: "track:2", kind: "video" as const, codec: "hvc1", decodable: true },
    ],
  };
  try {
    const result = await inspectFfmpegInput(
      { executable: colorProbe, ownerExecutable: owner },
      { file, metadata: videoMetadata, streamId: "track:2", inspectColor: true },
    );
    expect(result.map).toBe("0:1");
    expect(result.color).toEqual({
      colorPrimaries: "bt2020",
      transferFunction: "smpte2084",
      ycbcrMatrix: "bt2020nc",
      range: null,
      pixelFormat: "yuv420p10le",
    });
    const ordinary = await inspectFfmpegInput(
      { executable: colorProbe, ownerExecutable: owner },
      { file, metadata: videoMetadata, streamId: "track:2" },
    );
    expect(ordinary.color).toBeUndefined();
  } finally {
    await file.close();
  }
});
