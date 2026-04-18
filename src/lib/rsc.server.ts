import "@tanstack/react-start/server-only";

import type { AnyCompositeComponent } from "@tanstack/react-start/rsc";

const SERVER_COMPONENT_STREAM = Symbol.for("tanstack.rsc.stream");

type ServerComponentStream = {
  createReplayStream(): ReadableStream<Uint8Array>;
};

function getServerComponentStream(value: AnyCompositeComponent) {
  const stream = (value as any)[SERVER_COMPONENT_STREAM] as
    | ServerComponentStream
    | undefined;

  if (!stream) {
    throw new Error("Value is missing tanstack.rsc.stream");
  }

  return stream;
}

export async function serializeRsc(rsc: AnyCompositeComponent) {
  const stream = getServerComponentStream(rsc).createReplayStream();
  const bytes = await readableStreamToUint8Array(stream);
  const str = Buffer.from(bytes).toString("base64");
  return str;
}

async function readableStreamToUint8Array(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Array<Uint8Array> = [];
  let totalLength = 0;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return out;
}
