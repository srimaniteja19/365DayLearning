import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C1116",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            transform: "rotate(45deg)",
            border: "12px solid #3DDC97",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 24, height: 24, background: "#3DDC97" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
