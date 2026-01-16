import React from 'react'
import LoaderImg from '../images/loading.gif'

const Loader = () => {
  return (
    <div className="loader">
        <div className="loader__image">
            <img src={LoaderImg} />
        </div>
    </div>
  )
}

export default Loader