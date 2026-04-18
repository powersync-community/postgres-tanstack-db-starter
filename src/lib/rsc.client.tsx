"use client";

import { use, useMemo } from "react";
import {
  CompositeComponent,
  createFromReadableStream,
  type AnyCompositeComponent,
} from "@tanstack/react-start/rsc";
import { trackPostProcessPromise } from "@tanstack/react-start";
import React from "react";

const SERVER_COMPONENT_STREAM = Symbol.for("tanstack.rsc.stream");
const SERVER_COMPONENT_CSS_HREFS = Symbol.for("tanstack.rsc.cssHrefs");
const RSC_PROXY_GET_TREE = Symbol.for("tanstack.rsc.getTree");
const RSC_PROXY_PATH = Symbol.for("tanstack.rsc.path");

const REACT_ELEMENT_TYPE = Symbol.for("react.element");
const REACT_TRANSITIONAL_ELEMENT_TYPE = Symbol.for(
  "react.transitional.element",
);
const REACT_LAZY_TYPE = Symbol.for("react.lazy");
const REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");

type ServerComponentStream = {
  createReplayStream(): ReadableStream<Uint8Array>;
};

export function deserializeRsc(payload: string): AnyCompositeComponent {
  const bytes = base64ToUint8Array(payload);
  const cssHrefs = new Set<string>();

  let cachedTree: unknown = undefined;
  let cacheReady = false;

  const transformedTreePromise = createFromReadableStream(
    uint8ArrayToStream(bytes),
  ).then(async (tree) => {
    await awaitLazyElements(tree, (href) => {
      cssHrefs.add(href);
    });
    cachedTree = tree;
    cacheReady = true;
    return tree;
  });

  trackPostProcessPromise(transformedTreePromise);

  const streamWrapper: ServerComponentStream = {
    createReplayStream: () => uint8ArrayToStream(bytes),
  };

  const getTree = () => {
    if (cacheReady) return cachedTree;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return use(transformedTreePromise);
  };

  return createCompositeProxy({
    getTree,
    stream: streamWrapper,
    cssHrefs,
  });
}

function createCompositeProxy(state: {
  getTree: () => unknown;
  stream: ServerComponentStream;
  cssHrefs?: ReadonlySet<string>;
  path?: Array<string>;
}): AnyCompositeComponent {
  const path = state.path ?? [];
  const childCache = new Map<string, AnyCompositeComponent>();

  return new Proxy(function StoredCompositeProxy() {}, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      if (prop === SERVER_COMPONENT_STREAM) return state.stream;
      if (prop === SERVER_COMPONENT_CSS_HREFS) return state.cssHrefs;
      if (prop === RSC_PROXY_GET_TREE) return state.getTree;
      if (prop === RSC_PROXY_PATH) return path;
      if (typeof prop !== "string") return undefined;

      let child = childCache.get(prop);
      if (!child) {
        child = createCompositeProxy({
          ...state,
          path: [...path, prop],
        });
        childCache.set(prop, child);
      }
      return child;
    },
    has(_target, prop) {
      if (
        prop === SERVER_COMPONENT_STREAM ||
        prop === SERVER_COMPONENT_CSS_HREFS ||
        prop === RSC_PROXY_GET_TREE ||
        prop === RSC_PROXY_PATH
      ) {
        return true;
      }

      return typeof prop === "string";
    },
  }) as unknown as AnyCompositeComponent;
}

function uint8ArrayToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

type CssHrefCollector = (href: string) => void;

async function awaitLazyElements(
  tree: unknown,
  cssCollector?: CssHrefCollector,
): Promise<void> {
  for (const payload of findPendingLazyPayloads(
    tree,
    new Set(),
    cssCollector,
  )) {
    await Promise.resolve(payload).catch(() => {});
  }
}

function* findPendingLazyPayloads(
  value: unknown,
  seen: Set<unknown>,
  cssCollector?: CssHrefCollector,
): Generator<PromiseLike<unknown>> {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  const node = value as any;
  const isElement =
    node.$$typeof === REACT_ELEMENT_TYPE ||
    node.$$typeof === REACT_TRANSITIONAL_ELEMENT_TYPE;

  if (isElement && node.type === REACT_SUSPENSE_TYPE) {
    return;
  }

  if (isElement && node.type === "link" && node.props?.rel === "stylesheet") {
    const href = node.props["data-rsc-css-href"] as string | undefined;
    if (href && cssCollector) {
      cssCollector(href);
    }
  }

  if (node.$$typeof === REACT_LAZY_TYPE) {
    const payload = node._payload;
    if (
      payload &&
      typeof payload === "object" &&
      (payload.status === "pending" || payload.status === "blocked") &&
      typeof payload.then === "function"
    ) {
      yield payload;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      yield* findPendingLazyPayloads(item, seen, cssCollector);
    }
    return;
  }

  for (const key of Object.keys(node)) {
    if (key === "_owner" || key === "_store") continue;
    yield* findPendingLazyPayloads(node[key], seen, cssCollector);
  }
}

export const CompositeComponentFromString = React.memo(
  ({ src, ...rest }: any) => {
    const dzzd = useMemo(() => deserializeRsc(src), [src]);
    return <CompositeComponent src={dzzd} {...rest} />;
  },
);
