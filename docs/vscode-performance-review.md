# Performance review

Home activates on demand and loads project/deployment data only when its webview resolves or the user refreshes. Monitoring and resource data are not loaded during activation. Existing tree sections remain lazy. A future optimization should cache the Home summary between refreshes and add cancellation to long-running list requests.
