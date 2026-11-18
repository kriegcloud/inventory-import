// Sets the theme class before first paint so the page never flashes the wrong one.
// A file rather than an inline script, so the content security policy can forbid inline scripts.
try {
  var t = localStorage.getItem("theme")
  if (t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark")
  }
} catch (e) {}
