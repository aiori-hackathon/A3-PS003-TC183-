"""Serialise model parameters into byte payloads.

Communication cost is the length of the payload produced here (header included). This is the
size of the serialised application payload, not measured network traffic (no TCP/TLS overhead).

Payload layout: b"FTP1" | uint32 header length | JSON header | binary body
"""

from __future__ import annotations

import json
import math
import struct

import numpy as np

MAGIC = b"FTP1"
UPLINK_ENCODINGS = ("fp32", "fp16", "int8", "topk")
DOWNLINK_ENCODINGS = ("fp32", "fp16", "int8")

Tensors = dict[str, np.ndarray]


def raw_size(tensors: Tensors) -> int:
    """Bytes of the tensors as plain float32 (no header)."""
    return int(sum(t.size * 4 for t in tensors.values()))


def encode(tensors: Tensors, method: str, topk_ratio: float = 0.01) -> bytes:
    entries = []
    chunks: list[bytes] = []
    offset = 0

    def add(buf: bytes) -> tuple[int, int]:
        nonlocal offset
        chunks.append(buf)
        start = offset
        offset += len(buf)
        return start, len(buf)

    if method in ("fp32", "fp16"):
        dtype = "<f4" if method == "fp32" else "<f2"
        for name, t in tensors.items():
            start, n = add(np.ascontiguousarray(t, dtype=dtype).tobytes())
            entries.append({"name": name, "shape": list(t.shape), "offset": start, "length": n})
    elif method == "int8":
        for name, t in tensors.items():
            flat = t.astype(np.float32).ravel()
            lo, hi = (float(flat.min()), float(flat.max())) if flat.size else (0.0, 0.0)
            scale = (hi - lo) / 255.0 if hi > lo else 1.0
            q = np.clip(np.round((flat - lo) / scale), 0, 255).astype(np.uint8)
            start, n = add(q.tobytes())
            entries.append({"name": name, "shape": list(t.shape), "offset": start, "length": n, "min": lo, "scale": scale})
    elif method == "topk":
        names = list(tensors)
        flat = np.concatenate([tensors[n].astype(np.float32).ravel() for n in names]) if names else np.zeros(0, np.float32)
        total = flat.size
        k = max(1, int(math.ceil(topk_ratio * total))) if total else 0
        idx = np.argpartition(np.abs(flat), total - k)[total - k:] if k < total else np.arange(total)
        idx = np.sort(idx)
        idx_dtype = "<u2" if total <= 65535 else "<u4"
        i_start, i_len = add(idx.astype(idx_dtype).tobytes())
        v_start, v_len = add(flat[idx].astype("<f4").tobytes())
        entries = [{"name": n, "shape": list(tensors[n].shape)} for n in names]
        header_extra = {"total": int(total), "k": int(k), "idx_dtype": idx_dtype, "idx": [i_start, i_len], "val": [v_start, v_len]}
    else:
        raise ValueError(f"Unknown encoding '{method}'")

    header = {"method": method, "entries": entries}
    if method == "topk":
        header.update(header_extra)
    hbytes = json.dumps(header, separators=(",", ":")).encode()
    return MAGIC + struct.pack("<I", len(hbytes)) + hbytes + b"".join(chunks)


def decode(payload: bytes) -> Tensors:
    if payload[:4] != MAGIC:
        raise ValueError("Bad payload magic")
    (hlen,) = struct.unpack("<I", payload[4:8])
    header = json.loads(payload[8 : 8 + hlen])
    body = memoryview(payload)[8 + hlen :]
    method = header["method"]
    out: Tensors = {}
    if method in ("fp32", "fp16"):
        dtype = "<f4" if method == "fp32" else "<f2"
        for e in header["entries"]:
            arr = np.frombuffer(body[e["offset"] : e["offset"] + e["length"]], dtype=dtype)
            out[e["name"]] = arr.astype(np.float32).reshape(e["shape"])
    elif method == "int8":
        for e in header["entries"]:
            q = np.frombuffer(body[e["offset"] : e["offset"] + e["length"]], dtype=np.uint8)
            out[e["name"]] = (q.astype(np.float32) * e["scale"] + e["min"]).reshape(e["shape"])
    elif method == "topk":
        i0, il = header["idx"]
        v0, vl = header["val"]
        idx = np.frombuffer(body[i0 : i0 + il], dtype=header["idx_dtype"]).astype(np.int64)
        vals = np.frombuffer(body[v0 : v0 + vl], dtype="<f4")
        flat = np.zeros(header["total"], dtype=np.float32)
        flat[idx] = vals
        pos = 0
        for e in header["entries"]:
            n = int(np.prod(e["shape"])) if e["shape"] else 1
            out[e["name"]] = flat[pos : pos + n].reshape(e["shape"])
            pos += n
    else:
        raise ValueError(f"Unknown encoding '{method}'")
    return out
