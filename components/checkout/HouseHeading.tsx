export function HouseHeading({title,stage}:{title:string;stage:string}) {
  return <header className="house-check-heading">
    {stage !== title && <span>{stage}</span>}
    <h1>{title}</h1>
  </header>;
}
