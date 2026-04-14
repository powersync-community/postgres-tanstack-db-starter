import {
  createCompositeComponent,
  renderServerComponent,
} from "@tanstack/react-start/rsc";

// to use on the server environment
export function serializeRsc(
  rsc: Awaited<
    | ReturnType<typeof renderServerComponent>
    | ReturnType<typeof createCompositeComponent>
  >,
): Promise<string> {
  // access the underlying stream object
  // listen to the stream and accumulate everything inside
  // once stream completes, serialize the completed payload
  // base64 (or json) string
  // Maybe could use a lower level api like "renderToReadableStream"?
  throw new Error(`TODO`);
}

// to use in isomorphic/rendering environment
export function deserializeRsc(
  rsc: string,
):
  | ReturnType<typeof renderServerComponent>
  | ReturnType<typeof createCompositeComponent> {
  // decode base64 (or json) string
  // build the proxy object expected by React and <CompositeComponent>
  throw new Error(`TODO`);
}

// potential implementation for serialize since apparently these objects are just streams
// async function streamToString(
//   stream: ReadableStream<Uint8Array>,
// ): Promise<string> {
//   const reader = stream.getReader()
//   const chunks: Array<string> = []
//   const decoder = new TextDecoder()

//   while (true) {
//     const { done, value } = await reader.read()
//     if (done) break
//     chunks.push(decoder.decode(value, { stream: true }))
//   }

//   return chunks.join('')
// }
