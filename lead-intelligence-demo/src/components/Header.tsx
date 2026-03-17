export type Screen = "dashboard" | "get-leads";

interface HeaderProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function Header({ currentScreen, onNavigate }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <span className="app-header-firm">Sourcery</span>
      </div>
      <nav className="app-header-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`app-header-btn ${currentScreen === "dashboard" ? "app-header-btn-active" : ""}`}
          onClick={() => onNavigate("dashboard")}
          aria-current={currentScreen === "dashboard" ? "page" : undefined}
        >
          Lead Intelligence
        </button>
        <button
          type="button"
          className={`app-header-btn ${currentScreen === "get-leads" ? "app-header-btn-active" : ""}`}
          onClick={() => onNavigate("get-leads")}
          aria-current={currentScreen === "get-leads" ? "page" : undefined}
        >
          Get leads
        </button>
      </nav>
    </header>
  );
}
