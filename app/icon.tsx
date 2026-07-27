import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * Generated favicon — the app's ◈ brand mark on the default dark/mint theme,
 * drawn from plain shapes (no glyph/font fetch) so it renders identically
 * everywhere, including this build sandbox.
 */
export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            transform: "rotate(45deg)",
            border: "4px solid #3DDC97",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 8, height: 8, background: "#3DDC97" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
