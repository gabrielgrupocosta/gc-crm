import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from '../../services/firebase'
import { useToast } from './Toast'
import Modal from './Modal'

const ERROS_REAUTH = {
  'auth/wrong-password':          'Senha atual incorreta.',
  'auth/invalid-credential':      'Senha atual incorreta.',
  'auth/too-many-requests':       'Muitas tentativas. Aguarde um pouco e tente de novo.',
}

export default function AlterarSenhaModal({ isOpen, onClose }) {
  const { firebaseUser } = useAuth()
  const toast = useToast()

  const [senhaAtual, setSenhaAtual]     = useState('')
  const [novaSenha, setNovaSenha]       = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')

  function fecharEResetar() {
    setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setErro('')
    onClose()
  }

  const canSave = senhaAtual.length > 0 && novaSenha.length >= 6 && novaSenha === confirmarSenha

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave || saving || !firebaseUser) return
    setSaving(true)
    setErro('')
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, senhaAtual)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(firebaseUser, novaSenha)
      toast('Senha alterada com sucesso.', 'success')
      fecharEResetar()
    } catch (err) {
      setErro(ERROS_REAUTH[err.code] ?? 'Erro ao alterar a senha. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={fecharEResetar}
      title="Alterar senha"
      width="max-w-sm"
      footer={
        <>
          <button type="button" onClick={fecharEResetar} className="btn-secondary">Cancelar</button>
          <button form="alterar-senha-form" type="submit" disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </>
      }
    >
      <form id="alterar-senha-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="as-atual">Senha atual</label>
          <input
            id="as-atual" type="password"
            value={senhaAtual}
            onChange={e => setSenhaAtual(e.target.value)}
            className="input"
            autoFocus
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="as-nova">Nova senha</label>
          <input
            id="as-nova" type="password"
            value={novaSenha}
            onChange={e => setNovaSenha(e.target.value)}
            placeholder="Mínimo de 6 caracteres"
            className="input"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="as-confirmar">Confirmar nova senha</label>
          <input
            id="as-confirmar" type="password"
            value={confirmarSenha}
            onChange={e => setConfirmarSenha(e.target.value)}
            className="input"
            required
          />
          {confirmarSenha.length > 0 && novaSenha !== confirmarSenha && (
            <span className="text-[11px] text-negative">As senhas não coincidem.</span>
          )}
        </div>

        {erro && <span className="text-[12px] text-negative">{erro}</span>}
      </form>
    </Modal>
  )
}
