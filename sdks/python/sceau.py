import requests

class SceauClient:
    def __init__(self, api_url="https://sceau-app.vercel.app/api/v1/public/seal"):
        self.api_url = api_url

    def seal_file(self, file_path):
        with open(file_path, 'rb') as f:
            response = requests.post(self.api_url, files={'file': f})
        return response.json()
