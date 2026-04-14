import "@tanstack/react-start/server-only";

import { defaultSerovalPlugins, makeSerovalPlugin } from "@tanstack/router-core";
import { rscSerializationAdapter } from "@tanstack/react-start/rsc/serialization/server";
import { toJSONAsync } from "seroval";
import {
  createCompositeComponent,
  renderServerComponent,
} from "@tanstack/react-start/rsc";

const [adapter] = rscSerializationAdapter();
const plugins = [makeSerovalPlugin(adapter), ...defaultSerovalPlugins];

// to use on server environment
export async function serializeRsc(
  rsc: Awaited<
    | ReturnType<typeof renderServerComponent>
    | ReturnType<typeof createCompositeComponent>
  >,
): Promise<string> {
  return JSON.stringify(await toJSONAsync(rsc, { plugins }));
}
