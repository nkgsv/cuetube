import httplib2
import os
import sys
import json
import pandas as pd

from apiclient.discovery import build_from_document
from apiclient.errors import HttpError
from oauth2client.client import flow_from_clientsecrets
from oauth2client.file import Storage
from oauth2client.tools import argparser, run_flow
from xml.dom.minidom import parseString
from youtube_transcript_api import YouTubeTranscriptApi

# The CLIENT_SECRETS_FILE variable specifies the name of a file that contains

# the OAuth 2.0 information for this application, including its client_id and
# client_secret. You can acquire an OAuth 2.0 client ID and client secret from
# the {{ Google Cloud Console }} at
# {{ https://cloud.google.com/console }}.
# Please ensure that you have enabled the YouTube Data API for your project.
# For more information about using OAuth2 to access the YouTube Data API, see:
#   https://developers.google.com/youtube/v3/guides/authentication
# For more information about the client_secrets.json file format, see:
#   https://developers.google.com/api-client-library/python/guide/aaa_client_secrets
CLIENT_SECRETS_FILE = "client_secrets.json"

# This OAuth 2.0 access scope allows for full read/write access to the
# authenticated user's account and requires requests to use an SSL connection.
YOUTUBE_READ_WRITE_SSL_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl"
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

# This variable defines a message to display if the CLIENT_SECRETS_FILE is
# missing.
MISSING_CLIENT_SECRETS_MESSAGE = "MISSING_CLIENT_SECRETS_MESSAGE"

# Authorize the request and store authorization credentials.


def get_authenticated_service():
    flow = flow_from_clientsecrets(CLIENT_SECRETS_FILE, scope=YOUTUBE_READ_WRITE_SSL_SCOPE,
                                   message=MISSING_CLIENT_SECRETS_MESSAGE)

    print("%s-oauth2.json" % sys.argv[0])
    storage = Storage("%s-oauth2.json" % sys.argv[0])
    credentials = storage.get()

    flags = argparser.parse_args(args=[])
    if credentials is None or credentials.invalid:
        credentials = run_flow(flow, storage, flags)

    # Trusted testers can download this discovery document from the developers page
    # and it should be in the same directory with the code.
    with open("youtube-v3-discoverydocument.json", "r") as f:
        doc = f.read()
        return build_from_document(doc, http=credentials.authorize(httplib2.Http()))


def get_playlist_videos(youtube, playlist_id):
    request = youtube.playlistItems().list(
        part="snippet,contentDetails",
        maxResults=25,
        playlistId=playlist_id
    )
    response = request.execute()
    return [r['snippet'] for r in response['items']]

# Call the API's commentThreads.list method to list the existing comments.


def get_comments(youtube, video_id, channel_id):
    results = youtube.commentThreads().list(
        part="snippet",
        videoId=video_id,
        channelId=channel_id,
        textFormat="html"  # html | plainText
    ).execute()

    comments = []

    for item in results["items"]:
        comment = item["snippet"]["topLevelComment"]["snippet"]
        comments.append(comment)
    return comments

def time_to_sec(x):
    r = x.split(':')
    t = 0
    for i in range(len(r)):
        t = t*60 + int(r[i])
    return t

def get_cues_from_comment(comm):
    dom = parseString('<document>'+ comm['textDisplay'] +'</document>')
    cues = dom.getElementsByTagName('a')
    result = []
    for a in cues:
        start = a.childNodes[0].nodeValue
        if a.nextSibling == None:
            continue
        name = a.nextSibling.nodeValue.strip()
        author = comm['authorDisplayName']
        videoId = comm['videoId']
        videoTitle = comm['title']
        videoDescription = comm['description']
        result.append({'v': videoId,
                       'title': videoTitle,
                       'description': videoDescription,
                       'start': time_to_sec(start),
                       'end': None,
                       'name': name,
                       'author': author})
    for i in range(1,len(result)):
        result[i-1]['end'] = result[i]['start']
    return result

def get_all_cues(youtube, vids):
    cues = []
    for v in vids:
        videoId = v['resourceId']['videoId']
        print('Fetching comments from video ' + videoId + '...')
        for comm in get_comments(youtube, video_id=videoId, channel_id=None):
            comm['title'] = v['title']
            comm['description'] = v['description']
            cues.extend(get_cues_from_comment(comm))
    return cues

def get_all_transcripts(vids):
    transcripts = {}
    for v in vids:
        videoId = v['resourceId']['videoId']
        print('Fetching transcripts from video ' + videoId + '...')
        transcripts[videoId] = YouTubeTranscriptApi.get_transcript(videoId,languages=['ru'])
    return transcripts

def save_transcripts(transcripts, folder='./'):
    if not os.path.exists(folder):
        os.makedirs(folder)
    for k in transcripts:
        with open( folder + '/' + k + '.json', 'w', encoding='utf-8') as f:
            json.dump(transcripts[k], f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    youtube = get_authenticated_service()

    vids1 = get_playlist_videos(youtube, 'PLyBWNG-pZKx584rgaeX_bV8GE56X8TOw9')
    cues1 = get_all_cues(youtube, vids1)
    df1 = pd.DataFrame.from_dict(cues1)
    df1.to_excel('./public/cues1.xlsx')
    transcripts1 = get_all_transcripts(vids1)
    save_transcripts(transcripts1, folder='./public/transcripts/')

    vids2 = get_playlist_videos(youtube, 'PLyBWNG-pZKx4SSW1oCJjpCxkc6wTqglMl')
    cues2 = get_all_cues(youtube, vids2)
    df2 = pd.DataFrame.from_dict(cues2)
    df2.to_excel('./public/cues2.xlsx')
    transcripts2 = get_all_transcripts(vids2)
    save_transcripts(transcripts2, folder='./public/transcripts/')

    vids = vids1 + vids2
    with open( 'videos.json', 'w', encoding='utf-8') as f:
        json.dump(vids, f, ensure_ascii=False, indent=2)