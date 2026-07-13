async function run() {
  try {
    const tagsRes = await fetch('http://localhost:8788/api/auth/tags');
    const tags = await tagsRes.json();
    const tagIds = tags.slice(0, 3).map(t => t.id);
    
    const res = await fetch('http://localhost:8788/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_user1234',
        email: 'test_user1234@rathinam.edu',
        password: 'password123',
        college: 'RGU',
        bio: 'test bio',
        interests: tagIds
      })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch(err) {
    console.error('Error:', err);
  }
}

run();
