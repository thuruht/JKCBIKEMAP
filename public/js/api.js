export async function fetchFeatures() {
  const res = await fetch('/api/features');
  if (!res.ok) throw new Error('Failed to fetch features');
  return await res.json();
}

export async function createFeature(data, token) {
  const res = await fetch('/api/features', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create feature');
  return await res.json();
}

export async function updateFeature(id, data, token) {
  const res = await fetch(`/api/features/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update feature');
  return await res.json();
}
