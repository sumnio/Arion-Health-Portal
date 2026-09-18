import { useState } from 'react';

export default function FormField({ label, name, type = 'text', children, ...props }) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return <div className="form-field">
    <label htmlFor={name}>{label}</label>
    <div className={password ? 'password-input' : undefined}>
      {children ? <select id={name} name={name} {...props}>{children}</select>
        : <input id={name} name={name} type={password && visible ? 'text' : type} {...props} />}
      {password && <button type="button" className="password-toggle" aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button>}
    </div>
  </div>;
}

