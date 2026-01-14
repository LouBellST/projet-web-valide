import './App.css'
import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.GROUPS_API_URL || '/api';

function App() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [progress, setProgress] = useState(null);
  const eventSourceRef = useRef(null);

  // Charger la liste des groupes au montage
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const res = await fetch(API_URL + '/groups');
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Erreur chargement groupes', e);
      }
    };

    loadGroups();
  }, []);

  // Handler au clic sur un groupe
  const handleSelectGroup = async (groupId) => {
    // 1. Nettoyage de l'ancienne connexion si elle existe
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // 2. Reset des états UI
    setProgress({ percent: 0 });
    setSelectedGroup([]);

    const source = new EventSource(`${API_URL}/groups/${groupId}/stream`);
    eventSourceRef.current = source; // On stocke la réf

    source.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    });

    source.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      setSelectedGroup(data); // Affiche le groupe enrichi
      setProgress(null);
      source.close();         // Ferme la connexion proprement
      eventSourceRef.current = null;
    });

    source.onerror = () => {
      console.log('Erreur SSE');
      source.close();
      setProgress(null);
      eventSourceRef.current = null;
    };
  };

  return (
    <div>
      <main>
        <section>
          <h2>Groupes</h2>

          {groups.length === 0 && <p>Aucun groupe à afficher.</p>}

          <ul>
            {groups.map((group) => (
              <li
                key={group.gid}
                onClick={() => handleSelectGroup(group.gid)}
              >
                <strong>{group.name}</strong>
                {' - '}
                {group.memberCount ?? 0} membres
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Membres</h2>

          {!selectedGroup && (
            <div>
              <h3 style={{ background: '#7e9cffff', padding: '1rem', marginBottom: '1rem', borderRadius: '8px' }}>Group :</h3>
            </div>)}

          {selectedGroup && (
            <div>
              <h3 style={{ background: '#7e9cffff', padding: '1rem', marginBottom: '1rem', borderRadius: '8px' }}>Group : {selectedGroup.name}</h3>
              <ul>
                {selectedGroup.members?.map((member) => (
                  <li key={member.uuid}>
                    <strong>
                      {(member.prenom || '') + (member.nom ? ` ${member.nom}` : '')}
                    </strong>
                    <br />
                    <small>{member.email || 'Email inconnu'}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progress && (
            <div style={{ background: '#a2c4ff', padding: '1rem', borderRadius: '8px' }}>
              <h3>Chargement des membres...</h3>
              <progress value={progress.percent} max="100" style={{ width: '100%' }}></progress>
              <p style={{ textAlign: 'center' }}>
                {progress.percent}% ({progress.fetched}/{progress.total})
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;