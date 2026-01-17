import React, { useEffect, useState } from 'react'
import { DUMMY_POSTS } from './data'
import PostItem from './components/PostItem'
import axios from 'axios'
import Loader from './components/Loader'
import { useParams } from 'react-router-dom'
import usePostStream from './components/usePostStream'

const CategoryPosts = () => {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const {category} = useParams()

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/categories/${category}`)
        setPosts(response?.data || [])
      } catch (err) {
        console.log(err)
        setPosts([])
      }

      setIsLoading(false)
    }

    fetchPosts()
  }, [category])

  // Real-time updates via SSE
  usePostStream((event, payload) => {
    if (event === 'post_created' && payload.category === decodeURIComponent(category)) {
      setPosts(prev => [payload, ...prev])
    } else if (event === 'post_updated') {
      const updatedPost = payload
      if (updatedPost.category === decodeURIComponent(category)) {
        setPosts(prev => prev.map(p => (String(p._id) === String(updatedPost._id) ? updatedPost : p)))
      } else {
        // Post category changed, remove from this category
        setPosts(prev => prev.filter(p => String(p._id) !== String(updatedPost._id)))
      }
    } else if (event === 'post_deleted') {
      setPosts(prev => prev.filter(p => String(p._id) !== String(payload.postId)))
    } else if (event === 'post_liked') {
      setPosts(prev => prev.map(p => (String(p._id) === String(payload.postId) ? { ...p, likesCount: payload.likesCount } : p)))
    }
  })


  if(isLoading) {
    return <Loader />
  }

  // Decode category name from URL (handle spaces and special characters)
  const categoryName = decodeURIComponent(category || '')

  return (
    <section className="posts">
      <div className="container">
        <h1 className="h1__center" style={{ marginBottom: '2rem' }}>
          {categoryName ? `Posts in "${categoryName}"` : 'Category Posts'}
        </h1>
      </div>
      {posts.length > 0 ? (
        <div className="container posts__container">
          {posts.map((post) => (
            <PostItem
              key={post._id || post.id}
              postID={post._id || post.id}
              thumbnail={post.thumbnail}
              videoUrl={post.videoUrl}
              category={post.category}
              title={post.title}
              description={post.description}
              authorID={post.creator || post.authorID}
              createdAt={post.createdAt}
              likesCount={post.likesCount}
              likedBy={post.likedBy}
            />
          ))}
        </div>
      ) : (
        <h2 className='center'>No posts found in this category</h2>
      )}
    </section>
  )
}

export default CategoryPosts
