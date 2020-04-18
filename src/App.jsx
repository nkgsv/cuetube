import React from 'react';
import YouTube from 'react-youtube';
import queryString from 'query-string';
import Fuse from 'fuse.js';
import GetSheetDone from 'get-sheet-done';

import './App.css';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchQuery: '',
      scope: 'comments'
    }
    this.params = {
      v: 'W9nZ6u15yis',
      start: 5,
      end: 7
    }
    this.sources = [
      {section: 'fall', spreadsheetId: '1uGsDHbh9xjtaBlFxVQkXneZ28YfWxVv-VE3BJaf9tOs', sheetNumber: 1},
      {section: 'spring', spreadsheetId: '1uGsDHbh9xjtaBlFxVQkXneZ28YfWxVv-VE3BJaf9tOs', sheetNumber: 2},
    ]
    this.tracks = {};
    this.fuse = {};
    this.filteredTracks = {};
    window.app = this;
  }

  async loadTracksFromHTML(file) {
    let x = await fetch(file);
    let y = await x.text();
    let parser = new DOMParser();
    let htmlDoc = parser.parseFromString(y, 'text/html');
    let anchors = htmlDoc.getElementsByTagName('a');
    let tracks = Array.from(anchors).map((a,index) => {
      let v = a.href.match(/v=([^&]+)&/)[1];
      let start = a.href.match(/t=(\d+)s/)[1];
      let title = a.nextSibling.textContent.trim();
      return {v: v, start: start, title: title, index:index};
    });
    return tracks;
  }

  async componentDidMount() {
    let newParams = queryString.parse(window.location.search)
    this.params = {...this.params, ...newParams};

    // get list of videos
    let tmp = await fetch('videos.json');
    let videos = await tmp.json();
    this.tracks['videos'] = videos.map( (vid,ix) => ({...vid, index: ix, v: vid.resourceId.videoId}));
    this.fuse['videos'] = new Fuse(this.tracks['videos'], {
      includeScore: true,
      threshold: 0.4,
      keys: ['description']
    });

    // get list of comments
    let comments=[];
    for (let src of this.sources) {
      let sheet = await GetSheetDone.labeledCols(src.spreadsheetId, src.sheetNumber);
      comments = comments.concat(sheet.data.map( (comment) => ({section: src.section, ...comment})));
    }
    this.tracks['comments'] = comments.map((comment, ix) => ({index: ix, ...comment}));
    this.fuse['comments'] = new Fuse(this.tracks['comments'], {
      includeScore: true,
      threshold: 0.4,
      keys: ['name']
    });

    // get list of transcripts
    let startTime = performance.now();
    let responses = await Promise.all(videos.map(vid => fetch('./transcripts/' + vid.resourceId.videoId + '.json')));
    let transcripts = await Promise.all(responses.map(r => r.json()));
    let endTime = performance.now();
    console.log('Loaded transcripts in ' + (endTime - startTime)/1000 + 's');
    transcripts = transcripts.map( (x,i) => (x.map(y => ({...y, v: videos[i].resourceId.videoId}))))
    transcripts = [].concat.apply([], transcripts);
    this.tracks['transcripts'] = transcripts.map( (t, ix) => ({...t, index: ix, end: t.start + t.duration}));
    this.fuse['transcripts'] = new Fuse(this.tracks['transcripts'], {
      includeScore: true,
      threshold: 0.4,
      keys: ['text']
    });

    this.forceUpdate();
  }

  getLocation(track) {
    const order = ['v', 'start', 'end'];
    const search = queryString.stringify({
      v: track.v,
      start: track.start,
      end: track.end
    }, {
      sort: (a, b) => order.indexOf(a) - order.indexOf(b),
      skipNull: true
    });
    return '?' + search;
  }

  updateLocation(track) {
    this.params = {
      v: track.v,
      start: track.start,
      end: track.end
    }
    window.history.replaceState({}, null, this.getLocation(track));
  }

  getOpts() {
    return { // https://developers.google.com/youtube/player_parameters
      height: '450',
      width: '800',
      startSeconds: 0,
      playerVars: {
        autoplay: 0
      }
    };
  }

  filterTracks(query, scope=this.state.scope) {
    const results = this.fuse[scope].search(query);
    this.filteredTracks[scope] = results.map( r => ({...r.item, score: r.score}) );
  }

  handleQueryChange(event) {
    const searchQuery = event.target.value;
    this.filterTracks(searchQuery);
    this.setState({searchQuery: searchQuery});
  }

  onPlayerReady(event) {
    this.player = event.target;
    this.updatePlayer();
  }

  onClickTrack(event) {
    let target = event.currentTarget;
    let id = parseInt(target.id);
    let scope = this.state.scope;
    let t = this.tracks[scope][id];
    this.params = {v: t.v, start: t.start, end: t.end};

    this.updateLocation(t);
    this.updatePlayer();
    event.preventDefault();
  }

  renderTrack(t, scope=this.state.scope) {
    let searchKey=this.fuse[scope].options.keys[0];
    return <a href={this.getLocation(t)} className="track" id={t.index}
            key={t.index} onClick={this.onClickTrack.bind(this)}>
            <div>{t[searchKey]}</div>
            {t.title && t.description && <div className='info'>
              {t.title.match(/Лекция\s+№\s*\d+/)[0]} &bull; {t.description}
            </div>}
          </a>
  }

  renderLecture(l) {
    return <a href={'?v=' + l.resourceId.videoId} className="track" id={l.resourceId.videoId}
              key={l.resourceId.videoId} onClick={this.onClickLecture.bind(this)}>
              {l.description}
           </a>
  }

  updatePlayer() {
    if (this.player && this.params.v) {
      this.player.loadVideoById({
        videoId: this.params.v,
        startSeconds: this.params.start,
        endSeconds: this.params.end
      });
    }
  }

  onScopeChange(ev) {
    const newScope = ev.target.value;
    this.filterTracks(this.state.searchQuery, newScope);
    this.setState({scope: ev.target.value});
  }

  render() {
    return (
      <div className='App'>       
        {this.params &&
          <YouTube opts={this.getOpts()} onReady={this.onPlayerReady.bind(this)} />
        }
        <div className='control'>
          <select defaultValue={this.state.scope} onChange={this.onScopeChange.bind(this)}>
            <option value='videos'>descriptions</option>
            <option value='comments'>comments</option>
            <option value='transcripts'>transcripts</option>
          </select>
          <input type='text' placeholder='Search... (hit Tab and Enter to play the first cue)' value={this.state.searchQuery} onChange={this.handleQueryChange.bind(this)} />
          <a tabIndex='-1' href='#' >About</a>
        </div>
        {this.filteredTracks[this.state.scope] && <div className='tracks-list'>
          {this.filteredTracks[this.state.scope].map( t => this.renderTrack(t))}
        </div>}
        {this.tracks['videos'] && this.state.searchQuery.length === 0 && <div className='tracks-list'>
          {this.tracks['videos'].map( l => this.renderTrack(l, 'videos'))}
         </div>}
      </div>
    );
  }
}

export default App;