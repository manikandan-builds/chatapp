import "./avatar.css";

export default function Avatar({ userId, username, online }) {
  const colors = [
    'teal', 'red', 'green', 'purple',
    'blue', 'yellow', 'orange', 'pink', 'fuchsia', 'rose'
  ];
  const userIdBase10 = parseInt(userId.substring(10), 16);
  const colorIndex = userIdBase10 % colors.length;
  const colorClass = `avatar-${colors[colorIndex]}`;

  return (
    <div className={`avatar-container ${colorClass}`}>
      <div className="avatar-text">{username[0]}</div>
      <div className={`status-indicator ${online ? 'online' : 'offline'}`}></div>
    </div>
  );
}
