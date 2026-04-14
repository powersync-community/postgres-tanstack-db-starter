import "@tanstack/react-start/client-only";

import { defaultSerovalPlugins, makeSerovalPlugin } from "@tanstack/router-core";
import { rscSerializationAdapter } from "@tanstack/react-start/rsc/serialization/client";
import { fromJSON, type SerovalJSON } from "seroval";
import {
  createCompositeComponent,
  renderServerComponent,
} from "@tanstack/react-start/rsc";

const [adapter] = rscSerializationAdapter();
const plugins = [makeSerovalPlugin(adapter), ...defaultSerovalPlugins];

// to use in client/rendering environment
export function deserializeRsc(
  rsc: string,
):
  | ReturnType<typeof renderServerComponent>
  | ReturnType<typeof createCompositeComponent> {
  return fromJSON(JSON.parse(rsc) as SerovalJSON, { plugins });
}
