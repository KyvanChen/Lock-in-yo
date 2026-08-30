import type { MetadataRoute } from "next";

/** Lets the app be added to a phone home screen and open without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lock In",
    short_name: "Lock In",
    description:
      "A planner for coursework, projects and studying, with a focus timer built in.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
