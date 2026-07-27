import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS — same ◈ mark, larger canvas, drawn from plain shapes. */
export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            transform: "rotate(45deg)",
            border: "11px solid #3DDC97",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 22, height: 22, background: "#3DDC97" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
