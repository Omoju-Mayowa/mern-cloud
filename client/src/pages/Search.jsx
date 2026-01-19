import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import PostItem from './components/PostItem'
import Loader from './components/Loader'

const Search = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)

    const handleSearch = async (query) => {
        if (!query.trim()) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts?q=${query.trim()}`)
            setResults(Array.isArray(res.data) ? res.data : [])
        } catch (err) { setResults([]); } finally { setLoading(false) }
    }

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) handleSearch(q);
    }, [searchParams]);

    return (
        <section className="posts">
            <div className="container">
                <h2 className="center">Search Results</h2>
                <div className="form login__form" style={{ marginBottom: '3rem' }}>
                    <input
                        type="text"
                        placeholder="Search posts or topics..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSearchParams({ q: e.target.value });
                        }}
                    />
                </div>

                {loading ? <Loader /> : (
                    <div className="container posts__container">
                        {results.length > 0 ? results.map(post => (
                            <PostItem 
                                key={post._id}
                                postID={post._id}
                                thumbnail={post.thumbnail}
                                videoUrl={post.videoUrl}
                                category={post.category}
                                title={post.title}
                                description={post.description}
                                authorID={post.creator?._id || post.creator}
                                createdAt={post.createdAt}
                                likesCount={post.likesCount}
                                likedBy={post.likedBy}
                            />
                        )) : searchQuery && <p className="center">No results found for "{searchQuery}"</p>}
                    </div>
                )}
            </div>
        </section>
    )
}

export default Search;
