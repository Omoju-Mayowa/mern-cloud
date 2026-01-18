import React, { useState, useContext, useEffect } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useNavigate } from 'react-router-dom'
import { UserContext } from './components/context/userContext'
import axios from 'axios'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const CreatePost = () => {
  const [title, setTitle] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [thumbnail, setThumbnail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dots, setDots] = useState('.') // State for the animation
  const [categories, setCategories] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const navigate = useNavigate()

  const {currentUser} = useContext(UserContext)
  const token = currentUser?.token

  // Animation logic for the "Creating..." button
  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setDots(prev => (prev.length < 3 ? prev + '.' : '.'));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if(!token) { navigate('/login') }
  }, [token, navigate])

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ],
  }

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent', 'link', 'image'
  ]

  const submitPost = async (e) => {
    e.preventDefault();
    if (!title || !categoryInput || !description) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    const postData = new FormData();
    postData.set('title', title.trim());
    postData.set('category', categoryInput.trim());
    postData.set('description', description);
    if(thumbnail) postData.set('thumbnail', thumbnail);
    if(videoFile) postData.set('video', videoFile);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/posts`, postData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}` 
        }
      });
      if (response.status === 201 || response.status === 200) {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create post.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="create-post">
      <div className="container">
        <h2>Create Post</h2>
        {error && <p className='form__error-message'>{error}</p>}
        <form className="form create-post__form" onSubmit={submitPost}>
          <input type="text" placeholder='Title' value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          <input type="text" placeholder='Category' value={categoryInput} onChange={e => setCategoryInput(e.target.value)} />
          
          <ReactQuill modules={modules} formats={formats} value={description} onChange={setDescription} />
          
          <label>Thumbnail (Image)</label>
          <input type="file" onChange={e => setThumbnail(e.target.files[0])} accept='image/*' />

          <label>Video (Upload takes longer)</label>
          <input type="file" onChange={e => setVideoFile(e.target.files[0])} accept='video/*' />

          <button type='submit' onClick={scrollTop} className='btn primary' disabled={isLoading}>
            {isLoading ? `Creating${dots}` : 'Create'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default CreatePost;
