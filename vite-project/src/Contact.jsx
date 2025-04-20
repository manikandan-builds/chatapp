import Avatar from "./Avatar.jsx";
import "./contact.css";

export default function Contact({ id, username, onClick, selected, online }) {
  return (
    <div
      key={id}
      onClick={() => onClick(id)}
      className={`contact-item ${selected ? 'selected' : ''}`}
    >
      {selected && <div className="selection-bar"></div>}
      <div className="contact-inner">
        <Avatar online={online} username={username} userId={id} />
        <span className="contact-name">{username}</span>
      </div>
    </div>
  );
}
