import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
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
          borderRadius: 100,
        }}
      >
        <div
          style={{
            width: 224,
            height: 224,
            transform: "rotate(45deg)",
            border: "32px solid #3DDC97",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 64, height: 64, background: "#3DDC97" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
