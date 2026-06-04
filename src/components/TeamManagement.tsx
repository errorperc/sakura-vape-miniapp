import { Crown, Headset, LoaderCircle, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getTeamMembers, removeTeamMember, saveTeamMember } from '../lib/teamApi';
import type { TeamMember } from '../types';

type AssignableRole = 'admin' | 'manager';

const roleLabels = {
  owner: 'Главный админ',
  admin: 'Администратор',
  manager: 'Менеджер заказов',
  user: 'Пользователь',
};

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [telegramId, setTelegramId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<AssignableRole>('manager');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const managersCount = useMemo(() => members.filter((member) => member.role === 'manager').length, [members]);

  const loadMembers = async () => {
    setError('');
    try {
      setMembers(await getTeamMembers());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить команду.');
    }
  };

  useEffect(() => {
    void loadMembers();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const saved = await saveTeamMember({ telegramId, firstName, username, role });
      setMembers((current) => [saved, ...current.filter((member) => member.telegramId !== saved.telegramId)]);
      setTelegramId('');
      setFirstName('');
      setUsername('');
      setMessage(role === 'manager' ? 'Менеджер привязан и будет получать новые заказы.' : 'Администратор добавлен.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить аккаунт.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: TeamMember) => {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await removeTeamMember(member.telegramId);
      setMembers((current) => current.filter((candidate) => candidate.telegramId !== member.telegramId));
      setMessage('Доступ аккаунта отключён.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось отключить доступ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="team-management">
      <div className="section-heading team-management__heading">
        <div>
          <span className="eyebrow">Команда</span>
          <h2>Доступы и заказы</h2>
        </div>
        <span className="team-management__counter">
          <Headset size={15} aria-hidden="true" />
          {managersCount} менедж.
        </span>
      </div>

      <form className="team-add-form" onSubmit={submit}>
        <div className="team-role-switch" aria-label="Роль аккаунта">
          <button className={role === 'manager' ? 'is-active' : ''} type="button" onClick={() => setRole('manager')}>
            <Headset size={16} aria-hidden="true" />
            Менеджер
          </button>
          <button className={role === 'admin' ? 'is-active' : ''} type="button" onClick={() => setRole('admin')}>
            <ShieldCheck size={16} aria-hidden="true" />
            Администратор
          </button>
        </div>

        <div className="form-row">
          <label>
            Telegram ID
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{5,20}"
              value={telegramId}
              onChange={(event) => setTelegramId(event.target.value.replace(/\D/g, ''))}
              placeholder="123456789"
            />
          </label>
          <label>
            Имя
            <input required value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Алексей" />
          </label>
        </div>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@username" />
        </label>
        <button className="button button--primary" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="product-card__cart-loader" size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
          Добавить аккаунт
        </button>
        <p className="team-add-form__note">Менеджеру нужно один раз открыть бота, чтобы Telegram разрешил доставлять ему заказы.</p>
        {message ? <p className="form-note">{message}</p> : null}
        {error ? <p className="form-note form-note--warning">{error}</p> : null}
      </form>

      <div className="team-list">
        {members.map((member) => {
          const RoleIcon = member.role === 'owner' ? Crown : member.role === 'manager' ? Headset : UserCog;

          return (
            <article className={`team-member team-member--${member.role}`} key={member.telegramId}>
              <span className="team-member__icon" aria-hidden="true">
                <RoleIcon size={18} />
              </span>
              <div>
                <strong>{member.firstName}</strong>
                <span>{member.username ? `@${member.username}` : `ID ${member.telegramId}`}</span>
              </div>
              <em>{roleLabels[member.role]}</em>
              {member.role !== 'owner' ? (
                <button className="icon-button icon-button--danger" type="button" onClick={() => void remove(member)} disabled={busy} title="Отключить доступ">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
