/**
 * Campos que identificam e auditam qualquer entidade persistida do domínio.
 *
 * Entidades de domínio devem estender `BaseEntity` em vez de expor uma
 * estrutura solta. Isso mantém identidade e datas consistentes, sem acoplar o
 * domínio ao ORM ou ao transporte HTTP.
 */
export type EntityProps = {
  id: string
  createdAt: Date
  updatedAt: Date
}

export abstract class BaseEntity<TProps extends EntityProps> {
  protected constructor(protected readonly props: TProps) {}

  get id() {
    return this.props.id
  }

  get createdAt() {
    return this.props.createdAt
  }

  get updatedAt() {
    return this.props.updatedAt
  }
}
