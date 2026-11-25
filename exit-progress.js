// Keep progress visible even when the browser cannot activate a modal dialog.
export function showExitProgress(doc = document) {
 const dialog = doc.createElement('dialog');
 dialog.className = 'exit-progress-dialog';
 dialog.setAttribute('aria-labelledby', 'exit-progress-title');
 dialog.setAttribute('aria-describedby', 'exit-progress-stage');

 const spinner = doc.createElement('div');
 spinner.className = 'exit-progress-spinner';
 spinner.setAttribute('aria-hidden', 'true');
 const title = doc.createElement('h2');
 title.id = 'exit-progress-title';
 title.textContent = 'Saving and exiting…';
 const stage = doc.createElement('p');
 stage.id = 'exit-progress-stage';
 stage.setAttribute('role', 'status');
 stage.textContent = 'Saving local changes…';

 dialog.append(spinner, title, stage);
 dialog.addEventListener('cancel', event => event.preventDefault());
 doc.body.append(dialog);
 try {
  dialog.showModal();
 } catch {
  dialog.setAttribute('open', '');
 }
 return {
  update(text) { stage.textContent = text; },
  close() { dialog.remove(); }
 };
}
