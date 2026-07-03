export function TopNav({ adminOn }: { adminOn: boolean }) {
  return (
    <div className="app-topnav">
      <div className="logo">
        <span className="mark" />
        Installer Vault
      </div>
      <div className="topnav-right">
        <span className="pill">{adminOn ? "Admin: On" : "Admin Mode"}</span>
        <div className="avatar" />
      </div>
    </div>
  );
}
