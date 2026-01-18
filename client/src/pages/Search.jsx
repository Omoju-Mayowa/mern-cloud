import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import MediaDisplay from './components/MediaDisplay'
import LikeButton from './components/LikeButton'
import ReactTimeAgo from 'react-time-ago'
import Loader from './components/Loader'

const scrollTop = () => window.scrollTo(0, 0);

const Search = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const debounceTimer = useRef(null)

    const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

    // Consistent URL resolver for search results
    const resolveUrl = (path, type = 'post') => {
        if (!path || path.includes('default') || path === 'video-placeholder.png') {
            return type === 'avatar' 
                ? `${assetsBase}/mern/default-avatar.png` 
                : `${assetsBase}/mern/post-placeholder.png`;
        }
        if (path.startsWith('http')) return path;
        const cleanPath = path.startsWith('mern/') ? path : `mern/${path}`;
        return `${assetsBase}/${cleanPath}`;
    }

    // VIDEO HOVER LOGIC (Plays with sound)
    const handleMouseEnter = (e) => {
        const video = e.currentTarget.querySelector('video');
        if (video) {
            video.muted = false; // Enable sound on hover
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { /* Handle browser blocking autoplay with sound */ });
            }
        }
    };

    const handleMouseLeave = (e) => {
        const video = e.currentTarget.querySelector('video');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    };

    const handleSearch = async (query) => {
        if (!query.trim()) { setResults([]); return; }
        setLoading(true);
        try {
            // FIX: Changed endpoint from /posts/search to /posts
            // Most backends handle filtering via the main posts route
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts?q=${query.trim()}`)
            setResults(Array.isArray(response.data) ? response.data : [])
        } catch (err) {
            console.error("Search API Error:", err);
            setResults([]);
        } finally { setLoading(false) }
    }

    const handleSearchChange = (e) => {
        const query = e.target.value
        setSearchQuery(query)
        setSearchParams(query ? { q: query } : {}, { replace: true })
        
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => handleSearch(query), 500)
    }

    // Initial load search
    useEffect(() => {
        const q = searchParams.get('q')
        if (q) handleSearch(q)
    }, [])

    return (
        <section className="posts">
            <div className="container">
                <h2>Search Results</h2>
                <form onSubmit={(e) => e.preventDefault()} className="form login__form">
                    <input
                        type="text"
                        placeholder="Type to search..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        autoFocus
                    />
                </form>

                {loading ? <Loader size='small' /> : (
                    <div className="container posts__container">
                        {results.length > 0 ? results.map(post => (
                            <article key={post._id} className="post">
                                <div 
                                    className="post__thumbnail"
                                    onMouseEnter={handleMouseEnter}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    <MediaDisplay 
                                        type={post.videoUrl ? "video" : "image"} 
                                        src={resolveUrl(post.videoUrl || post.thumbnail)} 
                                        poster={resolveUrl(post.thumbnail)}
                                        alt={post.title}
                                        controls={false} // No controls as requested
                                        muted={false}    // Sound on hover
                                    />
                                </div>
                                <div className="post__content">
                                    <Link to={`/posts/${post._id}`} onClick={scrollTop}>
                                        <h3>{post.title}</h3>
                                        <p>{post.description?.replace(/<[^>]*>/g, '').substr(0, 145)}...</p>
                                    </Link>
                                    <div className="post__footer">
                                        <div className='post__author'>
                                            <div className="post__author-avatar">
                                                <img 
                                                    src={resolveUrl(post.creator?.avatar, 'avatar')} 
                                                    alt={post.creator?.name} 
                                                    onError={e => e.target.src = resolveUrl(null, 'avatar')}
                                                />
                                            </div>
                                            <div className="post__author-details">
                                                <h5>{post.creator?.name || 'Author'}</h5>
                                                {post.createdAt && <small><ReactTimeAgo date={new Date(post.createdAt)} locale='en-US' /></small>}
                                            </div>
                                        </div>
                                        <Link className='btn category' to={`/posts/categories/${post.category}`}>{post.category}</Link>
                                    </div>
                                </div>
                            </article>
                        )) : searchQuery && !loading && <p className="center">No results found for "{searchQuery}"</p>}
                    </div>
                )}
            </div>
        </section>
    )
}

export default Search;
