import React, { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from './components/context/userContext'
import axios from '../axios' // Import our custom instance

const CreatePost = () => {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Uncategorized')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [video, setVideo] = useState('')
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  const token = currentUser?.token

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  const createPost = async (e) => {
    e.preventDefault();
    const postData = new FormData();
    postData.set('title', title);
    postData.set('category', category);
    postData.set('description', description);
    if (thumbnail) postData.set('thumbnail', thumbnail);
    if (video) postData.set('video', video);

    try {
      // No need to include the full base URL, the interceptor has it
      await axios.post(`/posts`, postData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create post")
    }
  }

  return (
    <section className="create-post">
      <div className="container">
        <h2>Create Post</h2>
        {error && <p className='form__error-message'>{error}</p>}
        <form className="form create-post__form" onSubmit={createPost}>
          <input type="text" placeholder='Title' value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          <select name="category" value={category} onChange={e => setCategory(e.target.value)}>
            {["Agriculture", "Business", "Education", "Entertainment", "Art", "Investment", "Uncategorized", "Weather"].map(cat => <option key={cat}>{cat}</option>)}
          </select>
          <textarea placeholder='Description' value={description} onChange={e => setDescription(e.target.value)} rows={10}></textarea>
          <div className="form__control">
             <label htmlFor="thumbnail">Thumbnail</label>
             <input type="file" id="thumbnail" onChange={e => setThumbnail(e.target.files[0])} accept='image/*' />
          </div>
          <button type="submit" className='btn primary'>Create Post</button>
        </form>
      </div>
    </section>
  )
}

export default CreatePost
