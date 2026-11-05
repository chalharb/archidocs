/**
 * SVG outlines for element shapes (DIAG-11, ADD-004). Each shape is drawn at
 * the node's actual size and reports where its text area is.
 */
import type { ElementShape } from "@/domain/resources";

export interface ContentInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function contentInsets(shape: ElementShape, w: number, h: number): ContentInsets {
  switch (shape) {
    case "person":
      return { top: h * 0.36, right: 12, bottom: 6, left: 12 };
    case "cylinder":
      return {
        top: Math.min(24, h * 0.12) * 2,
        right: 12,
        bottom: Math.min(24, h * 0.12),
        left: 12,
      };
    case "storage":
      return { top: 24, right: 12, bottom: 8, left: 12 };
    case "queue":
      return { top: 8, right: Math.min(24, w * 0.08) * 2 + 4, bottom: 8, left: 16 };
    case "browser":
      return { top: 28, right: 12, bottom: 8, left: 12 };
    case "mobile":
      return { top: 22, right: 14, bottom: 22, left: 14 };
    default:
      return { top: 8, right: 12, bottom: 8, left: 12 };
  }
}

export function ShapeOutline({
  shape,
  width: w,
  height: h,
}: {
  shape: ElementShape;
  width: number;
  height: number;
}) {
  const s = 1; // half stroke, keeps the outline inside the box
  let body: React.ReactNode;
  switch (shape) {
    case "person": {
      const r = Math.min(h * 0.17, w * 0.2);
      const bodyTop = r * 2 - r * 0.25;
      body = (
        <>
          <rect
            className="fill"
            x={s}
            y={bodyTop}
            width={w - 2 * s}
            height={h - bodyTop - s}
            rx={Math.min(28, (h - bodyTop) / 3)}
          />
          <circle className="fill" cx={w / 2} cy={r + s} r={r} />
        </>
      );
      break;
    }
    case "cylinder": {
      const ry = Math.min(24, h * 0.12);
      const rx = w / 2 - s;
      body = (
        <>
          <path
            className="fill"
            d={`M ${s} ${ry} A ${rx} ${ry} 0 0 1 ${w - s} ${ry} L ${w - s} ${h - ry} A ${rx} ${ry} 0 0 1 ${s} ${h - ry} Z`}
          />
          <path
            className="detail"
            d={`M ${s} ${ry} A ${rx} ${ry} 0 0 0 ${w - s} ${ry}`}
            fill="none"
          />
        </>
      );
      break;
    }
    case "storage": {
      body = (
        <>
          <rect className="fill" x={s} y={s} width={w - 2 * s} height={h - 2 * s} rx={16} />
          <path className="detail" d={`M ${s + 10} 16 H ${w - s - 10}`} fill="none" />
        </>
      );
      break;
    }
    case "queue": {
      const rx = Math.min(24, w * 0.08);
      const ry = h / 2 - s;
      body = (
        <>
          <path
            className="fill"
            d={`M ${rx} ${s} L ${w - rx} ${s} A ${rx} ${ry} 0 0 1 ${w - rx} ${h - s} L ${rx} ${h - s} A ${rx} ${ry} 0 0 1 ${rx} ${s} Z`}
          />
          <path
            className="detail"
            d={`M ${w - rx} ${s} A ${rx} ${ry} 0 0 0 ${w - rx} ${h - s}`}
            fill="none"
          />
        </>
      );
      break;
    }
    case "browser": {
      body = (
        <>
          <rect className="fill" x={s} y={s} width={w - 2 * s} height={h - 2 * s} rx={8} />
          <path
            className="detail"
            d={`M ${s} 22 V ${8 + s} Q ${s} ${s} ${8 + s} ${s} H ${w - 8 - s} Q ${w - s} ${s} ${w - s} ${8 + s} V 22 Z`}
          />
          {[12, 22, 32].map((cx) => (
            <circle key={cx} className="accent" cx={cx} cy={11.5} r={3} />
          ))}
        </>
      );
      break;
    }
    case "mobile": {
      body = (
        <>
          <rect className="fill" x={s} y={s} width={w - 2 * s} height={h - 2 * s} rx={16} />
          <rect className="accent" x={w / 2 - 14} y={7} width={28} height={4} rx={2} />
          <circle className="accent" cx={w / 2} cy={h - 11} r={4} />
        </>
      );
      break;
    }
    default:
      body = <rect className="fill" x={s} y={s} width={w - 2 * s} height={h - 2 * s} rx={8} />;
  }
  return (
    <svg
      className="arch-node-shape"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      data-shape={shape}
    >
      {body}
    </svg>
  );
}
