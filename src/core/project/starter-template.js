const STARTER_FILES = {
    "layouts/base.tpl": `<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ page.title }}</title>
</head>
<body>
    <main>{% block content %}{% endblock %}</main>
</body>
</html>
`,
    "pages/home/home.tpl": `{% extends 'layouts/base.tpl' %}

{% block content %}
<h1>{{ page.title }}</h1>
<p>{{ page.description }}</p>
{% endblock %}
`,
    "data/pages/home/page.json": JSON.stringify({
        title: "Meine Website",
        description: "Dies ist die minimale Startseite deines Shorty-Projekts.",
    }, null, 2) + "\n",
    "assets/styles/base.scss": `body {
    font-family: system-ui, sans-serif;
}
`,
};

module.exports = { STARTER_FILES };
