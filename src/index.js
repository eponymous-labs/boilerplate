import "babel-polyfill/dist/polyfill.js"
import "shoelace-reload/default.js"

import "./app.css"

import React from "react"
import ReactDOM from "react-dom"

function App(props){
	return <div>hello world</div>
}

ReactDOM.render(<App />, document.getElementById("root"))