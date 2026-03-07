import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'robbertj85/parkeerdataviewer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, title, description, email } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 });
    }

    const typeLabels: Record<string, string> = {
      bug: '🐛 Bug',
      feature: '✨ Feature',
      data: '📊 Data',
      other: '💬 Overig',
    };

    const issueTitle = `[Feedback] ${typeLabels[type] || type}: ${title.trim()}`;
    const issueBody = [
      description ? `## Beschrijving\n${description.trim()}` : '',
      email ? `\n## Contact\n${email.trim()}` : '',
      `\n---\n_Ingediend via het feedbackformulier op ${new Date().toISOString().split('T')[0]}_`,
    ]
      .filter(Boolean)
      .join('\n');

    const labels = ['feedback'];
    if (type === 'bug') labels.push('bug');
    else if (type === 'feature') labels.push('enhancement');
    else if (type === 'data') labels.push('data');

    if (!GITHUB_TOKEN) {
      console.warn('GITHUB_TOKEN not set, logging feedback to console');
      console.log('Feedback:', { issueTitle, issueBody, labels });
      return NextResponse.json({ success: true, message: 'Feedback ontvangen (lokaal opgeslagen)' });
    }

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('GitHub API error:', err);
      return NextResponse.json({ error: 'Feedback kon niet worden opgeslagen' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Feedback ontvangen, bedankt!' });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
