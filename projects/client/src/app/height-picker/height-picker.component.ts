import {Component, effect, output, signal} from '@angular/core';
import {NgForOf} from "@angular/common";
import {HeightProp, HeightUnit} from "../../../../drag-drop-layout/src/lib/definitions";
import {FormsModule} from "@angular/forms";
import {HeightPropPickerComponent} from "../height-prop-picker/height-prop-picker.component";

@Component({
  selector: 'app-height-picker',
  standalone: true,
  imports: [
    NgForOf,
    FormsModule,
    HeightPropPickerComponent,
  ],
  templateUrl: './height-picker.component.html',
  styleUrl: './height-picker.component.less'
})
export class HeightPickerComponent {
  public heightUnitValue = signal<HeightProp>('auto');
  public heightProp = signal<HeightUnit>('0px');
  public valueMode = signal(false);

  public height = output<HeightProp>();

  constructor() {
    effect(() => {
      this.height.emit(this.valueMode() ? this.heightProp() : this.heightUnitValue());
    });
  }
}
