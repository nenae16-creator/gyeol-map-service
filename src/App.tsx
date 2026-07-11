import { InteractiveDaedongMapIntro } from "./components/InteractiveDaedongMapIntro";
import { GyeolServiceExperience } from "./components/GyeolServiceExperience";

export default function App() {
  const showLegacyExperience = new URLSearchParams(window.location.search).get("legacy") === "1";

  return showLegacyExperience ? <InteractiveDaedongMapIntro /> : <GyeolServiceExperience />;
}
