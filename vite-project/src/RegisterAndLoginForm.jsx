import { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from "./UserContext.jsx";
import "./form.css"; // import the CSS file

export default function RegisterAndLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginOrRegister, setIsLoginOrRegister] = useState('login');
  const [error, setError] = useState('');
  const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);

  async function handleSubmit(ev) {
    ev.preventDefault();
    const url = isLoginOrRegister === 'register' ? 'register' : 'login';

    try {
      const { data } = await axios.post(url, { username, password });
      setLoggedInUsername(username);
      setId(data.id);
      setError(''); // clear any previous error
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError('Invalid username or password.');
      } else if (err.response && err.response.status === 500) {
        setError('Username might already be taken.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <div className="page-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        <input
          value={username}
          onChange={ev => setUsername(ev.target.value)}
          type="text"
          placeholder="username"
        />
        <input
          value={password}
          onChange={ev => setPassword(ev.target.value)}
          type="password"
          placeholder="password"
        />
        <button>
          {isLoginOrRegister === 'register' ? 'Register' : 'Login'}
        </button>

        <div className="toggle-text">
          {isLoginOrRegister === 'register' ? (
            <div>
              Already a member?
              <button type="button" onClick={() => {
                setIsLoginOrRegister('login');
                setError('');
              }}>
                Login here
              </button>
            </div>
          ) : (
            <div>
              Don't have an account?
              <button type="button" onClick={() => {
                setIsLoginOrRegister('register');
                setError('');
              }}>
                Register
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
