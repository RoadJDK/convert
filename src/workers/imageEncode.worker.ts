import { encodeAvifWasm, encodeWebpWasm, optimisePngWasm } from "../lib/jsquash";

type WorkerRequest =
  | {
      id: number;
      type: "encode-image-data";
      format: "webp" | "avif";
      imageData: ImageData;
      quality: number;
    }
  | {
      id: number;
      type: "optimise-png";
      pngBuffer: ArrayBuffer;
      level: number;
    };

type WorkerResponse =
  | {
      id: number;
      ok: true;
      buffer: ArrayBuffer;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void | Promise<void>) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

const postResponse = (response: WorkerResponse) => {
  if (response.ok) {
    workerScope.postMessage(response, [response.buffer]);
    return;
  }

  workerScope.postMessage(response);
};

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === "optimise-png") {
      const buffer = await optimisePngWasm(request.pngBuffer, request.level);
      postResponse({ id: request.id, ok: true, buffer });
      return;
    }

    const buffer =
      request.format === "webp"
        ? await encodeWebpWasm(request.imageData, request.quality)
        : await encodeAvifWasm(request.imageData, request.quality);

    postResponse({ id: request.id, ok: true, buffer });
  } catch (error) {
    postResponse({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
